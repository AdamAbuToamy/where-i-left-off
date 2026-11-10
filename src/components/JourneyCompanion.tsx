/** A paper-and-bookmark companion derived from Wilo's layered-document identity. */
export default function JourneyCompanion({
  celebrate = false,
}: {
  celebrate?: boolean;
}) {
  return (
    <svg
      className={"journey-companion" + (celebrate ? " is-celebrating" : "")}
      viewBox="0 0 140 150"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="70"
        cy="139"
        rx="37"
        ry="5"
        fill="currentColor"
        opacity=".1"
      />
      <path
        d="M51 117L47 135M88 117L94 135"
        stroke="#365b49"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g className="companion-wave">
        <path
          d="M105 81Q129 80 126 55"
          stroke="#365b49"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M124 57L118 49M125 56L130 47"
          stroke="#365b49"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M33 84L17 98"
        stroke="#365b49"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect
        x="30"
        y="20"
        width="76"
        height="102"
        rx="18"
        fill="#809654"
        transform="rotate(-8 30 20)"
      />
      <rect
        x="35"
        y="24"
        width="76"
        height="102"
        rx="18"
        fill="#fff5e4"
        stroke="#d4c5a8"
        strokeWidth="2"
      />
      <path d="M85 25H100V48L92 43L85 48V25Z" fill="#b65a34" />
      <path d="M86 108L110 86V108Q110 126 92 126H86V108Z" fill="#e5d8bb" />
      <ellipse cx="56" cy="68" rx="4" ry="6" fill="#253d35" />
      <ellipse cx="87" cy="68" rx="4" ry="6" fill="#253d35" />
      <path
        d="M62 83Q72 93 82 83"
        stroke="#365b49"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="49" cy="79" r="5" fill="#d39170" opacity=".4" />
      <circle cx="93" cy="79" r="5" fill="#d39170" opacity=".4" />
      <path
        d="M43 105H75"
        stroke="#d7c8ad"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
