import { hyphenateSync } from "hyphen/en";

const defaultOptions = {
  selector: "p.microtype",
  maxSpaceShrink: 0.15, // How much space characters can shrink (em)
  maxSpaceGrow: 0.2, // How much space characters can grow (em)
  maxTrackingShrink: 0.01, // How much letter spacing can shrink (em)
  maxTrackingGrow: 0.01, // How much letter spacing can grow (em)
  protrusion: {
    ",": 0.15,
    ".": 0.2,
    "!": 0.15,
    "-": 0.25,
  },
};

(window as any).microtype = function ({
  selector = defaultOptions.selector,
  maxSpaceShrink = defaultOptions.maxSpaceShrink,
  maxSpaceGrow = defaultOptions.maxSpaceGrow,
  maxTrackingShrink = defaultOptions.maxTrackingShrink,
  maxTrackingGrow = defaultOptions.maxTrackingGrow,
  protrusion = defaultOptions.protrusion,
}: {
  selector: string;
  maxSpaceShrink: number;
  maxSpaceGrow: number;
  maxTrackingShrink: number;
  maxTrackingGrow: number;
  protrusion: { [key: string]: number };
} = defaultOptions) {
  const t0 = Date.now();
  console.log("microtype: initialising...");

  const paragraphs: NodeListOf<HTMLParagraphElement> =
    document.querySelectorAll(selector);

  for (const paragraph of paragraphs) {
    const targetWidth = paragraph.offsetWidth;
    const em = parseFloat(getComputedStyle(paragraph).fontSize);

    paragraph.style.whiteSpace = "nowrap";

    const text = paragraph.innerText;
    paragraph.innerHTML = "";

    let currentLine = 0;
    let currentLineWidth = 0;

    const words = text.split(" ");

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      let lineEl: HTMLSpanElement | null;
      if (currentLineWidth === 0) {
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

      wordEl.dataset.ww = wordEl.offsetWidth.toString();
      wordEl.dataset.lw = currentLineWidth.toString();

      let spaceEl;
      if (words[i + 1]) {
        spaceEl = document.createElement("span");

        spaceEl.innerHTML = "&nbsp;";
        lineEl.appendChild(spaceEl);

        spaceEl.dataset.sp = "true";

        currentLineWidth += spaceEl.offsetWidth;

        spaceEl.dataset.ww = spaceEl.offsetWidth.toString();
        spaceEl.dataset.lw = currentLineWidth.toString();
        spaceEl.dataset.pw = word;
      }

      if (currentLineWidth >= targetWidth) {
        let widthOver = currentLineWidth - targetWidth;

        // hyphenate protruding words

        let didHyphenate = false;

        const hyphenChar = "-";
        const hyphenated = hyphenateSync(word, {
          hyphenChar,
        });

        const split = hyphenated.split(hyphenChar);

        let bestWidthDiff = widthOver;
        let bestSegments = [word];

        if (split.length > 1) {
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
            remainingWordSpaceEl.dataset.pw = tail;

            const breakEl = document.createElement("br");
            lineEl.appendChild(breakEl);

            currentLineWidth -= nextLineEl.offsetWidth;

            wordEl.dataset.lw = currentLineWidth.toString();

            didHyphenate = true;
          } else {
            wordEl.innerText = word;
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

    lines.forEach((lineEl) => {
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

    lines.forEach((lineEl) => {
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
