import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const date = searchParams.get('date'); // ISO string or YYYY-MM-DD
    const time = searchParams.get('time'); // HH:mm
    const duration = parseInt(searchParams.get('duration') || '60', 10);
    const location = searchParams.get('location') || '';
    const description = searchParams.get('description') || '';

    if (!title || !date || !time) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    try {
        // Construct Start Date
        // Assuming date is YYYY-MM-DD and time is HH:mm:ss or HH:mm
        const startDateTimeString = `${date}T${time}`;
        const startDate = new Date(startDateTimeString);

        if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: 'Invalid date/time format' }, { status: 400 });
        }

        const endDate = new Date(startDate.getTime() + duration * 60000);

        // Floating time helper (no 'Z')
        const toFloatingICS = (d: Date) => {
            const pad = (n: number) => n < 10 ? '0' + n : n.toString();
            return (
                d.getFullYear() +
                pad(d.getMonth() + 1) +
                pad(d.getDate()) +
                'T' +
                pad(d.getHours()) +
                pad(d.getMinutes()) +
                pad(d.getSeconds())
            );
        };

        const now = new Date();

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//NextApp//ProctoringSystem//EN',
            'BEGIN:VEVENT',
            `DTSTAMP:${toFloatingICS(now)}`,
            `DTSTART:${toFloatingICS(startDate)}`,
            `DTEND:${toFloatingICS(endDate)}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${description}`,
            `LOCATION:${location}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n'); // ICS prefers CRLF

        return new NextResponse(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics"`,
            },
        });

    } catch (error) {
        console.error('Error generating ICS:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
