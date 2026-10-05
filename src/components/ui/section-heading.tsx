import type { ReactNode } from "react";

type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  action?: ReactNode;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <div className="section-heading-row">
        <div>
          <h2 className="section-title" id={id}>
            {title}
          </h2>
          {description ? <p className="section-description">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
