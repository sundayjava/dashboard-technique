import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
  try {
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    // Format dates for Forex Factory (format: mon1.1.2026)
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const startMonth = months[today.getMonth()];
    const startDay = today.getDate();
    const startYear = today.getFullYear();
    
    const forexFactoryUrl = `https://www.forexfactory.com/calendar?week=${startMonth}${startDay}.${startYear}`;

    const response = await fetch(forexFactoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 1800 } // Cache for 30 minutes
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from Forex Factory');
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events: any[] = [];
    let currentDate = '';
    
    $('tr.calendar__row').each((index, element) => {
      try {
        const $row = $(element);
        const dateCell = $row.find('td.calendar__date').text().trim();
        if (dateCell) currentDate = dateCell;

        const time = $row.find('td.calendar__time').text().trim();
        const currency = $row.find('td.calendar__currency').text().trim();
        
        const impactElement = $row.find('td.calendar__impact span');
        let impact: 'high' | 'medium' | 'low' = 'low';
        if (impactElement.hasClass('high')) impact = 'high';
        else if (impactElement.hasClass('medium')) impact = 'medium';

        const eventTitle = $row.find('td.calendar__event span.calendar__event-title').text().trim();
        const forecast = $row.find('td.calendar__forecast').text().trim() || '-';
        const previous = $row.find('td.calendar__previous').text().trim() || '-';

        if (eventTitle && time && currency) {
          const eventDate = parseDateString(currentDate, startYear);
          if (eventDate && eventDate >= today && eventDate <= weekFromNow) {
            events.push({
              id: `${index}`,
              date: eventDate.toISOString().split('T')[0],
              time: time || 'All Day',
              country: currency,
              event: eventTitle,
              impact,
              forecast,
              previous
            });
          }
        }
      } catch (error) {
        console.error('Error parsing calendar row:', error);
      }
    });

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        events: getFallbackEvents(),
        timestamp: new Date().toISOString(),
        source: 'Fallback (Forex Factory unavailable)'
      });
    }

    return NextResponse.json({
      success: true,
      events: events.slice(0, 20),
      timestamp: new Date().toISOString(),
      source: 'Forex Factory'
    });
  } catch (error) {
    console.error('Error fetching economic calendar:', error);
    return NextResponse.json({
      success: true,
      events: getFallbackEvents(),
      timestamp: new Date().toISOString(),
      source: 'Fallback data'
    });
  }
}

function parseDateString(dateStr: string, year: number): Date | null {
  try {
    if (!dateStr) return null;
    const months: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    const parts = dateStr.toLowerCase().split(' ').filter(p => p);
    const monthStr = parts.find(p => months[p] !== undefined);
    const dayStr = parts.find(p => !isNaN(parseInt(p)));
    if (monthStr && dayStr) {
      return new Date(year, months[monthStr], parseInt(dayStr));
    }
    return null;
  } catch {
    return null;
  }
}

function getFallbackEvents() {
  const today = new Date();
  return [
    {
      id: '1',
      date: formatDate(addDays(today, 1)),
      time: '08:30',
      country: 'USD',
      event: 'Consumer Price Index (CPI)',
      impact: 'high' as const,
      forecast: '3.2%',
      previous: '3.1%'
    },
    {
      id: '2',
      date: formatDate(addDays(today, 2)),
      time: '14:00',
      country: 'USD',
      event: 'Federal Reserve Interest Rate Decision',
      impact: 'high' as const,
      forecast: '5.50%',
      previous: '5.50%'
    },
    {
      id: '3',
      date: formatDate(addDays(today, 3)),
      time: '09:00',
      country: 'EUR',
      event: 'ECB President Speech',
      impact: 'medium' as const,
      forecast: '-',
      previous: '-'
    },
    {
      id: '4',
      date: formatDate(addDays(today, 4)),
      time: '08:30',
      country: 'USD',
      event: 'Initial Jobless Claims',
      impact: 'medium' as const,
      forecast: '215K',
      previous: '212K'
    },
    {
      id: '5',
      date: formatDate(addDays(today, 5)),
      time: '10:00',
      country: 'USD',
      event: 'GDP Growth Rate',
      impact: 'high' as const,
      forecast: '2.8%',
      previous: '2.6%'
    },
    {
      id: '6',
      date: formatDate(addDays(today, 6)),
      time: '13:30',
      country: 'GBP',
      event: 'Bank of England Rate Decision',
      impact: 'high' as const,
      forecast: '5.25%',
      previous: '5.25%'
    }
  ];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
