export default function Empty({ title, body, icon: Icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      {Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : null}
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {body ? <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}