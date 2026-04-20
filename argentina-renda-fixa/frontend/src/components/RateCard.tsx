interface RateCardProps {
  label: string;
  value: number | null;
  description: string;
  color: string;
}

export function RateCard({ label, value, description, color }: RateCardProps) {
  return (
    <div className={`rounded-2xl p-6 shadow-md bg-white border-l-4 ${color}`}>
      <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-4xl font-bold mt-1 text-gray-900">
        {value !== null ? `${value.toFixed(2)}%` : '—'}
      </p>
      <p className="text-xs text-gray-400 mt-2">{description}</p>
    </div>
  );
}
