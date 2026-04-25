export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 16%, rgba(30,114,219,0.10), transparent 24%), radial-gradient(circle at 88% 18%, rgba(30,114,219,0.08), transparent 22%)",
        }}
      />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
