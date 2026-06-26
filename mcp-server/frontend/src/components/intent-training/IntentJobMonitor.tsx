import { useQuery } from "@tanstack/react-query";
import { fetchIntentJob } from "@/lib/intent-training-api";

export function IntentJobMonitor({ jobId }: { jobId?: string | null }) {
  const { data: job } = useQuery({
    queryKey: ["intent-job", jobId],
    queryFn: () => fetchIntentJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data?.state === "running" || q.state.data?.state === "queued" ? 2000 : false,
  });

  if (!jobId || !job) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-border bg-card p-3 shadow-lg text-sm">
      <p className="font-medium">Job {job.id?.slice(0, 8)}</p>
      <p className="text-xs text-muted-foreground">{job.state} · {job.progress}%</p>
      {job.error && <p className="text-xs text-destructive mt-1">{job.error}</p>}
    </div>
  );
}
