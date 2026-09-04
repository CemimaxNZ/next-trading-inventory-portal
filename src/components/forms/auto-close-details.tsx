"use client";

type AutoCloseDetailsProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  summaryClassName?: string;
  title: React.ReactNode;
};

export function AutoCloseDetails({
  children,
  className,
  contentClassName,
  summaryClassName,
  title,
}: AutoCloseDetailsProps) {
  return (
    <details
      className={className}
      onSubmitCapture={(event) => {
        event.currentTarget.open = false;
      }}
    >
      <summary className={summaryClassName}>{title}</summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}
