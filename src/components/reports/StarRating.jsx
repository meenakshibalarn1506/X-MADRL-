import { Star } from "lucide-react";

/**
 * 5-star rating selector. Click a star to set the value; click the same star
 * again to clear. `readOnly` renders a display-only row.
 */
export default function StarRating({ value = 0, onChange, size = 20, readOnly = false }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(value === n ? 0 : n)}
          className={"transition-transform " + (readOnly ? "cursor-default" : "hover:scale-110")}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={n <= value ? "fill-primary text-primary" : "text-muted-foreground/50"}
            style={{ width: size, height: size }}
          />
        </button>
      ))}
      {value > 0 && <span className="mono ml-1 text-[11px] text-muted-foreground">{value}/5</span>}
    </div>
  );
}