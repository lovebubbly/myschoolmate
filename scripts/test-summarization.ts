
import { formatNoticeContent, analyzeNotice } from '../src/lib/gemini';
import dotenv from 'dotenv';
dotenv.config();

async function testPerformance() {
    const problematicNotice = `
    극동전선㈜의 인재 추천
    
    가. 모집요강
    모집 부문	담당 업무	인원	지역	자격 요건
    Production [생산팀] | 생산 공정(신선/연선/절연/외장/피복)관리 기술 지원 및 기술 문서 작성개정 보조
    품질 관련 과제 지원: 품질 결함 대응, 공정 개선, 스크랩품질등급 향상 활동
    생산지표(KPI: OEE, 스크랩, 5S, 안전) 데이터 분석 및 개선 활동 보조
    작업 환경제품 안전성 향상 및 안전품질보건 교육 지원
    제조설비 투자 검토 및 하도급업체 기술 평가 지원 | 0명 | 충북 청주 남이 | 전공: 공학 계열(전기, 전자, 기계공학, 신소재 등)
    영어 활용 능력(말하기 & 읽기 & 쓰기)
    케이블 및 전선 산업에 대한 관심과 기초적인 이해도 보유자
    자차 보유자(통근버스 운영하나, 생산직렬 근무 스케쥴(8:00출근, 20:00퇴근)에 맞춰 운행)
    Technical팀 | 고객 및 시장의 요구를 분석하여 케이블 설계
    표준 및 인증에 부합하는 케이블 개발 및 유지
    원가 절감 및 성능 향상을 위한 신소재 검토
    고객 요구사항에 맞춘 케이블의 전기적, 기계적, 열적, 환경적 평가 및 적용
    원가 산정을 위한 고객의 요구 사항 검토 및 케이블 설계
    내부 및 외부의 기술 지원 | | 충북 청주 남이 | 전공: 공학 계열(전기, 전자, 기계공학, 신소재 등)
    영어 활용 능력(말하기 & 읽기 & 쓰기)
    케이블 및 전선 산업에 대한 관심과 기초적인 이해도 보유자
    자차 보유자(통근버스 운영하나, 생산직렬 근무 스케쥴(8:00출근, 20:00퇴근)에 맞춰 운행)
    근무 조건 | 1. 고용형태: 인턴 6개월 대졸초임: 월 215만 원 정도
    나. 모집 기한: 2025. 12. 21.(일), 23:00까지
    `;

    console.log("--- Testing formatNoticeContent ---");
    const formatted = await formatNoticeContent(problematicNotice);
    console.log(formatted);

    console.log("\n--- Testing analyzeNotice ---");
    const analysis = await analyzeNotice("극동전선㈜의 인재 추천", problematicNotice);
    console.log(JSON.stringify(analysis, null, 2));
}

testPerformance().catch(console.error);
