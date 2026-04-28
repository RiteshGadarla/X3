import { Badge } from '../ui/Badge';
import { useEffect, useState } from 'react';

const PRIORITY_BADGE = {
  P1: 'error',
  P2: 'warning',
  P3: 'primary',
  P4: 'neutral',
};

const STATUS_BADGE = {
  new: 'cyan',
  triaged: 'primary',
  in_progress: 'warning',
  escalated: 'error',
  pending_hil: 'pink',
  resolved: 'success',
  closed: 'neutral',
};

function SLATimer({ deadline }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [overdue, setOverdue] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = new Date(deadline) - Date.now();
      if (diff <= 0) {
        setOverdue(true);
        setTimeLeft('Overdue');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
      setOverdue(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return <span style={{ color: 'var(--neutral-5)' }}>—</span>;
  return (
    <span style={{ color: overdue ? 'var(--error)' : 'var(--success)', fontWeight: 600, fontSize: '12px' }}>
      {overdue ? '🔴' : '🟢'} {timeLeft}
    </span>
  );
}

export default function TicketRow({ ticket }) {
  return (
    <tr>
      <td><span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>{ticket.ticket_ref}</span></td>
      <td>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{ticket.customer_name}</div>
        <div style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>{ticket.customer_email}</div>
      </td>
      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
      <td><Badge variant="neutral" style={{ fontSize: '10px' }}>{ticket.category}</Badge></td>
      <td><Badge variant={PRIORITY_BADGE[ticket.priority]}>{ticket.priority}</Badge></td>
      <td><Badge variant={STATUS_BADGE[ticket.status] || 'neutral'}>{ticket.status.replace(/_/g, ' ')}</Badge></td>
      <td><SLATimer deadline={ticket.sla_deadline} /></td>
      <td style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
    </tr>
  );
}
