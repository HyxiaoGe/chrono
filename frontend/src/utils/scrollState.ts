export interface PageScrollState {
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
}

interface ScrollViewport {
  scrollY: number;
  innerHeight: number;
}

interface ScrollDocument {
  documentElement: {
    scrollHeight: number;
  };
}

export function readPageScrollState(
  viewport: ScrollViewport = window,
  page: ScrollDocument = document,
): PageScrollState {
  return {
    scrollTop: viewport.scrollY,
    scrollHeight: page.documentElement.scrollHeight,
    viewportHeight: viewport.innerHeight,
  };
}
