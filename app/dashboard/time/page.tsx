import { getCurrentTime, updateCurrentTime } from "@/app/lib/actions";
import { lusitana } from '@/app/ui/fonts';
import { cacheLife, cacheTag } from "next/cache";

export default async function Page() {
  'use cache';
  cacheLife({ stale: 5, revalidate : 10, expire: 600 });
  cacheTag('currentTime');
  const currentTime = await getCurrentTime();
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        时间戳Demo
      </h1>
      <div className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>Current Time: {currentTime}</div>
      <button type="button" onClick={updateCurrentTime} className={`${lusitana.className} mb-4 text-xl md:text-2xl bg-blue-500 text-white px-4 py-2 rounded-md`}>Update Current Time</button>
    </main>
  );
}