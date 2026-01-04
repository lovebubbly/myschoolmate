'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Notice {
  title: string;
  url: string;
  date: string;
  category: string;
}

export default function Home() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notices/crawl');
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <main className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">CBNU ICE Notices</h1>
          <Button onClick={fetchNotices} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Notices'}
          </Button>
        </header>

        <section className="space-y-4">
          {notices.length === 0 ? (
            <p className="text-gray-500 text-center py-10">No notices fetched yet. Click Refresh.</p>
          ) : (
            notices.map((notice, idx) => (
              <Card key={idx} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-medium text-blue-600 hover:underline">
                      <a href={notice.url} target="_blank" rel="noreferrer">
                        {notice.title}
                      </a>
                    </CardTitle>
                    <span className="text-sm text-gray-400 whitespace-nowrap ml-4">{notice.date}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                    {notice.category}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
