import { Archive } from 'lucide-react';

export default function PreconRemoval({ busy, remove }: { busy: boolean; remove: () => void }) {
  return <div className="precon-remove-action"><button className="text-button" disabled={busy} onClick={remove}><Archive size={14} />Remove precons</button><small>Restore anytime</small></div>;
}
