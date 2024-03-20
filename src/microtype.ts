import { hyphenateSync } from "hyphen/en";

type MicrotypeOptions = {
  selector: string;
  maxSpaceShrink: number;
  maxSpaceGrow: number;
  maxTrackingShrink: number;
  maxTrackingGrow: number;
  protrusion: { [key: string]: number };
  hyphenate: boolean;
};

const defaultOptions: MicrotypeOptions = {
  selector: "p.microtype",
  maxSpaceShrink: 0.15, // How much space characters can shrink (em)
  maxSpaceGrow: 0.25, // How much space characters can grow (em)
  maxTrackingShrink: 0.01, // How much letter spacing can shrink (em)
  maxTrackingGrow: 0.01, // How much letter spacing can grow (em)
  protrusion: {
    // How much certain characters may protrude from the right margin (em)
    ",": 0.1,
    ".": 0.15,
    "!": 0.1,
    "-": 0.2,
  },
  hyphenate: true, // Whether or not words may hyphenate across lines
};

(window as any).microtype = function ({
  selector = defaultOptions.selector,
  maxSpaceShrink = defaultOptions.maxSpaceShrink,
  maxSpaceGrow = defaultOptions.maxSpaceGrow,
  maxTrackingShrink = defaultOptions.maxTrackingShrink,
  maxTrackingGrow = defaultOptions.maxTrackingGrow,
  protrusion = defaultOptions.protrusion,
  hyphenate = defaultOptions.hyphenate,
}: MicrotypeOptions = defaultOptions) {
  const t0 = Date.now();
  console.log("microtype: initialising...");

  const styleEl = document.createElement("style");
  document.head.appendChild(styleEl);
  const styleSheet = styleEl.sheet;
  if (styleSheet)
    styleSheet.insertRule(`${selector} span { text-indent: 0!important }`, 0);

  const paragraphs: NodeListOf<HTMLParagraphElement> =
    document.querySelectorAll(selector);

  for (const paragraph of paragraphs) {
    const em = parseFloat(getComputedStyle(paragraph).fontSize);
    const indent = parseFloat(getComputedStyle(paragraph).textIndent);

    paragraph.style.whiteSpace = "nowrap";

    const text = paragraph.innerText;
    paragraph.innerHTML = "";

    let currentLine = 0;
    let currentLineWidth = currentLine === 0 ? indent : 0;

    let targetWidth;

    const words = text.split(" ");

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      targetWidth = paragraph.offsetWidth - (currentLine === 0 ? indent : 0);

      let lineEl: HTMLSpanElement | null;
      if ((currentLine === 0 && i === 0) || currentLineWidth === 0) {
        lineEl = document.createElement("span");
        lineEl.dataset.li = currentLine.toString();
        paragraph.appendChild(lineEl);
      } else {
        lineEl = paragraph.querySelector(`span[data-li="${currentLine}"]`);
      }

      if (!lineEl) {
        throw new Error(`microtype: line ${currentLine} does not exist`);
      }

      const wordEl = document.createElement("span");

      wordEl.innerHTML = word;
      lineEl.appendChild(wordEl);

      currentLineWidth += wordEl.offsetWidth;

      let spaceEl;
      if (words[i + 1]) {
        spaceEl = document.createElement("span");

        spaceEl.innerHTML = "&nbsp;";
        lineEl.appendChild(spaceEl);

        spaceEl.dataset.sp = "true";

        currentLineWidth += spaceEl.offsetWidth;
      }

      if (currentLineWidth >= targetWidth) {
        let widthOver = currentLineWidth - targetWidth;

        // hyphenate protruding words

        let didHyphenate = false;

        if (hyphenate) {
          const hyphenChar = "-";
          const hyphenated = hyphenateSync(word, {
            hyphenChar,
          });

          const split = hyphenated.split(hyphenChar);

          let bestWidthDiff = widthOver;
          let bestSegments = [word];

          if (split.length > 1) {
            const widthWordRemoved = Math.abs(
              targetWidth - currentLineWidth - wordEl.offsetWidth,
            );
            if (widthWordRemoved < bestWidthDiff) {
              bestWidthDiff = widthWordRemoved;
              bestSegments = [];
            }

            const nOptions = split.length - 1;
            for (let j = 1; j <= nOptions; j++) {
              const head = split.slice(0, j);
              const tail = split.slice(j);

              wordEl.innerText = head.join("") + hyphenChar;

              const newWidth = lineEl.offsetWidth;
              const newDiff = Math.abs(newWidth - targetWidth);

              if (newDiff < bestWidthDiff) {
                bestWidthDiff = newDiff;
                bestSegments = [head.join(""), tail.join("")];
              }
            }

            const [head, tail] = bestSegments;

            if (tail) {
              wordEl.innerText = head + hyphenChar;

              const trailingSpaceEl = lineEl.querySelector(
                'span[data-sp="true"]:last-child',
              );
              if (trailingSpaceEl) trailingSpaceEl.remove();

              const nextLineEl = document.createElement("span");
              nextLineEl.dataset.li = (currentLine + 1).toString();
              paragraph.appendChild(nextLineEl);

              const remainingWord = document.createElement("span");
              remainingWord.innerText = tail;
              nextLineEl.appendChild(remainingWord);

              const remainingWordSpaceEl = document.createElement("span");

              remainingWordSpaceEl.innerHTML = "&nbsp;";
              nextLineEl.appendChild(remainingWordSpaceEl);

              remainingWordSpaceEl.dataset.sp = "true";

              const breakEl = document.createElement("br");
              lineEl.appendChild(breakEl);

              currentLineWidth -= nextLineEl.offsetWidth;

              didHyphenate = true;
            } else {
              wordEl.innerText = word;
            }
          }
        }

        // wrap protruding words

        widthOver = currentLineWidth - targetWidth;
        const widthUnder = Math.abs(
          currentLineWidth - wordEl.offsetWidth - targetWidth,
        );

        if (widthOver > widthUnder && !didHyphenate) {
          wordEl.remove();
          if (spaceEl) spaceEl.remove();
          i--;
        }

        const trailingSpaceEl = lineEl.querySelector(
          'span[data-sp="true"]:last-child',
        );
        if (trailingSpaceEl) trailingSpaceEl.remove();

        if (!didHyphenate) {
          const breakEl = document.createElement("br");
          lineEl.appendChild(breakEl);

          currentLineWidth = 0;
        } else {
          const existingNextLine: HTMLSpanElement | null =
            paragraph.querySelector(`span[data-li="${currentLine + 1}"]`);

          currentLineWidth = existingNextLine?.offsetWidth ?? 0;
        }

        currentLine++;
      }
    }

    // adjust spaces

    const lines: NodeListOf<HTMLSpanElement> =
      paragraph.querySelectorAll("span[data-li]");

    lines.forEach((lineEl, i) => {
      targetWidth = paragraph.offsetWidth - (i === 0 ? indent : 0);

      const lastWordEl: HTMLSpanElement | null =
        lineEl.querySelector("span:last-of-type");
      const protrusionAmount = lastWordEl
        ? protrusion?.[lastWordEl.innerText[lastWordEl.innerText.length - 1]] ??
          0
        : 0;

      const adjustedTargetWidth = targetWidth + protrusionAmount * em;

      const spaces: NodeListOf<HTMLSpanElement> = lineEl.querySelectorAll(
        'span[data-sp="true"]',
      );

      if (lineEl.offsetWidth > adjustedTargetWidth) {
        const toShrink =
          (lineEl.offsetWidth - adjustedTargetWidth) / spaces.length;
        spaces.forEach((spEl) => {
          spEl.style.display = "inline-block";
          spEl.style.width = `${spEl.offsetWidth - Math.min(toShrink, maxSpaceShrink * em)}px`;
        });
      } else if (lineEl.offsetWidth < adjustedTargetWidth) {
        const toGrow =
          (adjustedTargetWidth - lineEl.offsetWidth) / spaces.length;
        spaces.forEach((spEl) => {
          spEl.style.display = "inline-block";
          spEl.style.width = `${spEl.offsetWidth + Math.min(toGrow, maxSpaceGrow * em)}px`;
        });
      }
    });

    // adjust letter spacing

    lines.forEach((lineEl, i) => {
      targetWidth = paragraph.offsetWidth - (i === 0 ? indent : 0);

      const lastWordEl: HTMLSpanElement | null =
        lineEl.querySelector("span:last-of-type");
      const protrusionAmount = lastWordEl
        ? protrusion?.[lastWordEl.innerText[lastWordEl.innerText.length - 1]] ??
          0
        : 0;

      const adjustedTargetWidth = targetWidth + protrusionAmount * em;

      if (lineEl.offsetWidth > adjustedTargetWidth) {
        const diff = lineEl.offsetWidth - adjustedTargetWidth;
        const letterDiff = Math.min(
          diff / lineEl.innerText.length,
          maxTrackingShrink * em,
        );
        lineEl.style.letterSpacing = `-${letterDiff}px`;
      } else if (lineEl.offsetWidth < adjustedTargetWidth) {
        const diff = adjustedTargetWidth - lineEl.offsetWidth;
        const letterDiff = Math.min(
          diff / lineEl.innerText.length,
          maxTrackingGrow * em,
        );
        lineEl.style.letterSpacing = `${letterDiff}px`;
      }
    });
  }

  console.log(`microtype: done. took ${Date.now() - t0}ms`);
};
