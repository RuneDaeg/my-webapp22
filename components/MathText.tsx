"use client";

import katex from "katex";

// $...$ 로 감싼 LaTeX 수식을 KaTeX로 렌더링하고, 나머지는 일반 텍스트(줄바꿈 유지)로 보여준다.
// 문항 content/options처럼 사용자가 편집 가능한 텍스트에 쓰인다 — throwOnError:false로
// 문법 오류 수식은 빨간 원문 그대로 표시되어 어디가 틀렸는지 알 수 있다.
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const html = katex.renderToString(part.slice(1, -1), {
            throwOnError: false,
            output: "html",
          });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
