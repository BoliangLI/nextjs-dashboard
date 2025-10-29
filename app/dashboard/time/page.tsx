import { Suspense } from "react";

import { getCurrentTime, updateCurrentTime } from "@/app/lib/actions";
import { lusitana } from '@/app/ui/fonts';
import { cacheLife, cacheTag } from "next/cache";

const SuspenseTime = async () => {
  'use cache';
  cacheLife('minutes');
  cacheTag('currentTime');
  const currentTime = await getCurrentTime();
  return <div className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>Current Time: {currentTime}</div>;
};

export default function Page() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        时间戳Demo
      </h1>
      <Suspense fallback={<div>Loading...</div>}>
        <SuspenseTime />
      </Suspense>
      <button type="button" onClick={updateCurrentTime} className={`${lusitana.className} mb-4 text-xl md:text-2xl bg-blue-500 text-white px-4 py-2 rounded-md`}>Update Current Time</button>
    </main>
  );
}