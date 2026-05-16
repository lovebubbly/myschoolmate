import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { prisma } from '@/lib/prisma';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';

interface MenuData {
  restaurant: string;
  date: string;
  mealType: MealType;
  menuContent: string;
  price?: string;
}

type ParsedMenuCard = {
  menuContent: string;
  price?: string;
};

const MENU_SOURCE_URL = 'https://www.cbnucoop.com/service/restaurant/';
const RESTAURANTS = [
  { id: 'Hanbit', selector: '#tab1' },
  { id: 'Star', selector: '#tab2' },
  { id: 'Eunhasu', selector: '#tab3' },
] as const;
const WEEK_OFFSETS = [0, 1, -1];
const REQUEST_TIMEOUT_MS = 15000;

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeInlineText(value: string | null | undefined) {
  return normalizeText(value).replace(/\s*\n\s*/g, ' ').trim();
}

function resolveMealType(label: string, fallback: MealType = 'LUNCH'): MealType {
  if (/아침|조식/.test(label)) return 'BREAKFAST';
  if (/저녁|석식/.test(label)) return 'DINNER';
  if (/점심|중식|주말운영|백반|일품/.test(label)) return 'LUNCH';
  return fallback;
}

function isClosedMenu(title: string, body: string) {
  const text = `${title} ${body}`.replace(/\s+/g, '');
  return /미운영|운영안함|휴무|메뉴없음|등록된메뉴가없습니다/.test(text);
}

async function fetchMenuHtml(weekOffset: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(MENU_SOURCE_URL);
    url.searchParams.set('week', String(weekOffset));
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`CBNU cafeteria responded with ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function attachRenderedMenus($: cheerio.CheerioAPI) {
  $('#menu-result .menu').each((_, menuElement) => {
    const tableKey = $(menuElement).attr('data-table');
    if (!tableKey) return;

    const target = $(`td#table-${tableKey}`).first();
    if (target.length === 0) return;

    target.append($(menuElement));
  });
}

function extractMenuCard($: cheerio.CheerioAPI, card: Element): ParsedMenuCard | null {
  const $card = $(card);
  const title = normalizeInlineText($card.find('.card-header').first().text());
  const sideItems = $card
    .find('.side')
    .map((_, side) => normalizeInlineText($(side).text()))
    .get()
    .filter(Boolean);

  const bodyText = normalizeText($card.find('.card-body').first().text());
  if (isClosedMenu(title, bodyText)) return null;

  const prices = Array.from(new Set((bodyText.match(/￦\s*[\d,]+(?:\([^)]*\))?/g) || []).map((price) => price.replace(/\s+/g, ''))));
  const lines = [title, ...sideItems].filter(Boolean);
  if (lines.length === 0) return null;

  return {
    menuContent: lines.join('\n'),
    price: prices.join(' / ') || undefined,
  };
}

export function parseCafeteriaMenuHtml(html: string): MenuData[] {
  const $ = cheerio.load(html);
  attachRenderedMenus($);

  const menus: MenuData[] = [];

  for (const restaurant of RESTAURANTS) {
    const $tab = $(restaurant.selector).first();
    if ($tab.length === 0) continue;

    const dates = $tab
      .find('thead th.weekday-title')
      .map((_, element) => normalizeInlineText($(element).text()))
      .get()
      .filter(Boolean);

    if (dates.length === 0) continue;

    let activeMealType: MealType = 'LUNCH';

    $tab.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const rowTime = normalizeInlineText($row.find('.row-time').first().text());
      if (rowTime) {
        activeMealType = resolveMealType(rowTime, activeMealType);
        return;
      }

      const rowLabel = normalizeInlineText($row.find('.row-label').first().text()) || normalizeInlineText($row.children('th').first().text());
      const mealType = resolveMealType(rowLabel, activeMealType);

      $row.children('td').each((dateIndex, cell) => {
        const date = dates[dateIndex];
        if (!date) return;

        const cardResults = $(cell)
          .find('.menu-body')
          .map((_, card) => extractMenuCard($, card))
          .get()
          .filter((item): item is ParsedMenuCard => Boolean(item?.menuContent));

        if (cardResults.length === 0) return;

        menus.push({
          restaurant: restaurant.id,
          date,
          mealType,
          menuContent: cardResults.map((item) => item.menuContent).join('\n\n'),
          price: Array.from(new Set(cardResults.map((item) => item.price).filter(Boolean))).join(' / ') || undefined,
        });
      });
    });
  }

  return menus;
}

export async function crawlCafeteriaMenu() {
  const allMenus: MenuData[] = [];

  for (const weekOffset of WEEK_OFFSETS) {
    const html = await fetchMenuHtml(weekOffset);
    allMenus.push(...parseCafeteriaMenuHtml(html));
  }

  const uniqueMenus = new Map<string, MenuData>();
  for (const menu of allMenus) {
    const key = `${menu.restaurant}:${menu.date}:${menu.mealType}`;
    uniqueMenus.set(key, menu);
  }

  let savedCount = 0;
  for (const menu of uniqueMenus.values()) {
    await prisma.cafeteriaMenu.upsert({
      where: {
        restaurant_date_mealType: {
          restaurant: menu.restaurant,
          date: menu.date,
          mealType: menu.mealType,
        },
      },
      update: {
        menuContent: menu.menuContent,
        price: menu.price,
      },
      create: {
        restaurant: menu.restaurant,
        date: menu.date,
        mealType: menu.mealType,
        menuContent: menu.menuContent,
        price: menu.price,
      },
    });
    savedCount += 1;
  }

  console.log(`Cafeteria crawl completed. Saved ${savedCount} menus.`);
  return { savedCount };
}
