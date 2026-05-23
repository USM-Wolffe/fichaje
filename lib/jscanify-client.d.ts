declare module "jscanify/client" {
  interface CornerPoint {
    x: number;
    y: number;
  }
  interface PaperCorners {
    topLeftCorner?: CornerPoint;
    topRightCorner?: CornerPoint;
    bottomLeftCorner?: CornerPoint;
    bottomRightCorner?: CornerPoint;
  }
  interface CvMatLike {
    delete(): void;
  }
  class JScanify {
    findPaperContour(img: CvMatLike): CvMatLike | null;
    getCornerPoints(contour: CvMatLike): PaperCorners;
    extractPaper(
      image: HTMLCanvasElement,
      resultWidth: number,
      resultHeight: number,
    ): HTMLCanvasElement | null;
  }
  export default JScanify;
}
