# microtype

A JavaScript package that implements LaTeX-like text justification, hyphenation, and other micro-typographic adjustments. The name of course is borrowed from the [microtype LaTeX package](https://eu.mirrors.cicku.me/ctan/macros/latex/contrib/microtype/microtype.pdf).

## Usage

The package can be installed via npm, and imported as an ES module:

```
npm install microtypejs
```

```js
import microtype from "microtypejs";
```

Or loaded directly via a CDN:

```html
<script src="https://unpkg.com/microtypejs/dist/microtype.js"></script>
```

Once the package is loaded, the most basic usage is just to call the `microtype` function with an array of elements you want to format.

At present, the elements you want to format **must contain nothing but text**. Paragraphs containing inline elements are not supported. This is something I want to improve in the future.

```js
microtype({
  elements: document.querySelectorAll("p")
});
```

More on other configuration options below.

## Options

The full list of available options and their defaults are as follows:

```ts
type MicrotypeOptions = {
  elements: HTMLElement[];
  maxSpaceShrink: number;
  maxSpaceGrow: number;
  maxTrackingShrink: number;
  maxTrackingGrow: number;
  protrusion: { [key: string]: number };
  hyphenate: boolean;
  showFrame: boolean;
};

const defaultOptions: MicrotypeOptions = {
  elements: [], // The array of elements to format
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
  showFrame: false, // Whether or not to show the target frame for formatted elements (for debugging)
};
```

## Demo

TODO
