export default function ProductsLoading() {
  return <main className="catalogSkeleton pageWidth"><div /><div className="productGrid">{Array.from({ length: 8 }, (_, index) => <article key={index}><span /><i /><i /></article>)}</div></main>;
}
