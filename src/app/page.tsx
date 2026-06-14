import WorldCupHub from '@/components/WorldCupHub';

// The hub is fully interactive (search, modals, favorites, localStorage) and
// fetches `/api/matches` on mount, so it owns the client runtime end-to-end.
export default function Home() {
  return <WorldCupHub />;
}
