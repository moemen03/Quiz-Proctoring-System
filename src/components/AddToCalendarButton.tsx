'use client';

import * as React from 'react';

import { CalendarPlus } from 'lucide-react';
import { Quiz } from '@/lib/api-client';

interface AddToCalendarButtonProps {
  quiz: Quiz;
  locationName?: string;
  isHeadProctor?: boolean;
}

export function AddToCalendarButton({ quiz, locationName = 'TBD', isHeadProctor = false }: AddToCalendarButtonProps) {
  const [calendarLink, setCalendarLink] = React.useState<string>('');

  React.useEffect(() => {
    if (!quiz.date || !quiz.start_time) return;

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isAndroid = /android/i.test(userAgent);
    
    const titlePrefix = isHeadProctor ? '[1️⃣ First Proctor] ' : '';
    const eventTitle = `${titlePrefix}Proctoring: ${quiz.course_name}`;
    const descPrefix = isHeadProctor ? 'YOU ARE THE FIRST PROCTOR.\n' : '';
    const eventDescription = `${descPrefix}Proctoring assignment for ${quiz.course_name}. Duration: ${quiz.duration_minutes || 60} minutes.`;

    if (isAndroid) {
      // Use Android Intent to open the native calendar app
      const startTime = new Date(`${quiz.date}T${quiz.start_time}`);
      const duration = quiz.duration_minutes || 60;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      const startMs = startTime.getTime();
      const endMs = endTime.getTime();
      const location = locationName || '';

      // Android Intent URI structure
      // We perform double encoding/parameter setting to be safe for different Android versions/parsers
      const intentUrl = `intent://insert` + 
        `?title=${encodeURIComponent(eventTitle)}` + 
        `&description=${encodeURIComponent(eventDescription)}` + 
        `&eventLocation=${encodeURIComponent(location)}` + 
        `&beginTime=${startMs}` + 
        `&endTime=${endMs}` + 
        `#Intent;scheme=content;type=vnd.android.cursor.item/event;` + 
        `S.title=${encodeURIComponent(eventTitle)};` + 
        `S.description=${encodeURIComponent(eventDescription)};` + 
        `S.eventLocation=${encodeURIComponent(location)};` + 
        `l.beginTime=${startMs};` + 
        `l.endTime=${endMs};` + 
        `end`;

      setCalendarLink(intentUrl);
    } else {
      // Default to ICS for iOS and others
      const params = new URLSearchParams({
        title: eventTitle,
        date: quiz.date,
        time: quiz.start_time,
        duration: (quiz.duration_minutes || 60).toString(),
        location: locationName || '',
        description: eventDescription
      });
      setCalendarLink(`/api/ics?${params.toString()}`);
    }
  }, [quiz, locationName, isHeadProctor]);

  if (!calendarLink) return null;

  return (
    <a
      href={calendarLink}
      className="p-1 hover:bg-slate-700/50 rounded transition-colors text-slate-400 hover:text-indigo-400 inline-block"
      title="Add to Calendar"
      // Force download/open behavior by not opening in new tab, allowing default browser handling for ICS content
    >
      <CalendarPlus className="w-4 h-4" />
    </a>
  );
}
