import TicketRow from './TicketRow';

export default function TicketTable({ tickets, loading }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Customer</th>
            <th>Subject</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Status</th>
            <th>SLA Remaining</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--neutral-4)', padding: '40px' }}>Loading tickets…</td></tr>
          ) : tickets.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--neutral-4)', padding: '40px' }}>No tickets found</td></tr>
          ) : tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
