"""Generate the deliberately fictional MathPath PDF parsing fixture."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "content" / "fixtures" / "demo-ingestion-fixture.pdf"
LABEL = "DEMO INGESTION FIXTURE — NOT OFFICIAL"


def register_font() -> str:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
    ]
    font_path = next((candidate for candidate in candidates if candidate.is_file()), None)
    if font_path is None:
        raise RuntimeError("Install a Unicode TrueType font (Arial, DejaVu Sans, or Liberation Sans).")
    pdfmetrics.registerFont(TTFont("FixtureSans", str(font_path)))
    return "FixtureSans"


def text(pdf: canvas.Canvas, font: str, x: int, y: int, value: str, size: int = 11) -> None:
    pdf.setFont(font, size)
    pdf.drawString(x, y, value)


def part_heading(pdf: canvas.Canvas, font: str, value: str, y: int) -> None:
    pdf.setFont(font, 14)
    pdf.drawString(42, y, value)


def generate() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    font = register_font()
    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter, invariant=1, pageCompression=0)
    pdf.setTitle(LABEL)
    pdf.setAuthor("MathPath synthetic ingestion test")
    width, _ = letter

    # Page 1: Part I, with question 3 deliberately continued on page 2.
    text(pdf, font, 42, 758, LABEL, 9)
    part_heading(pdf, font, "PHẦN I - CHỌN MỘT ĐÁP ÁN", 728)
    text(pdf, font, 42, 696, "Câu 1. Cho hàm số f(x) = x² − 4x + 3. Giá trị nhỏ nhất của f(x) là", 11)
    text(pdf, font, 62, 674, "A. -1", 10)
    text(pdf, font, 172, 674, "B. 0", 10)
    text(pdf, font, 282, 674, "C. 3", 10)
    text(pdf, font, 392, 674, "D. 4", 10)
    text(pdf, font, 42, 624, "Câu 2. Với x = 2, biểu thức 3x + 1 có giá trị là:", 11)
    text(pdf, font, 62, 602, "A. 5", 10)
    text(pdf, font, 172, 602, "B. 6", 10)
    text(pdf, font, 282, 602, "C. 7", 10)
    text(pdf, font, 392, 602, "D. 8", 10)
    text(pdf, font, 42, 550, "Câu 3. Chọn mô tả đúng về đồ thị hàm số như hình bên dưới.", 11)
    text(pdf, font, 62, 528, "Hình vẽ có trục tọa độ và một parabol mở lên.", 10)

    # Embedded vector illustration: coordinate axes and a simple parabola, not a missing-art placeholder.
    pdf.setStrokeColorRGB(0.12, 0.12, 0.12)
    pdf.setLineWidth(1.25)
    pdf.line(82, 335, 274, 335)
    pdf.line(150, 286, 150, 426)
    parabola = pdf.beginPath()
    parabola.moveTo(92, 390)
    parabola.curveTo(120, 348, 180, 348, 208, 390)
    pdf.drawPath(parabola)
    pdf.line(142, 335, 158, 335)
    pdf.line(150, 327, 150, 343)
    pdf.setFont(font, 9)
    pdf.drawString(278, 332, "x")
    pdf.drawString(154, 424, "y")
    pdf.drawString(154, 346, "O")
    pdf.showPage()

    # Page 2: continuation of Part I Q3, then two grouped true/false questions.
    text(pdf, font, 42, 758, LABEL, 9)
    text(pdf, font, 42, 724, "Tiếp câu 3: Dựa vào đồ thị ở trang trước, đồ thị có dạng nào?", 11)
    text(pdf, font, 62, 702, "A. Đường thẳng", 10)
    text(pdf, font, 212, 702, "B. Parabol quay xuống", 10)
    text(pdf, font, 62, 680, "C. Đường tròn", 10)
    text(pdf, font, 212, 680, "D. Parabol mở lên", 10)
    part_heading(pdf, font, "PHẦN II - ĐÚNG/SAI", 650)
    text(pdf, font, 42, 620, "Câu 1. Cho hàm số g(x) = x² − 1. Xét tính đúng/sai của các mệnh đề:", 11)
    text(pdf, font, 62, 596, "a) g(0) = -1.", 10)
    text(pdf, font, 62, 576, "b) Đồ thị g(x) đi qua điểm (1; 0).", 10)
    text(pdf, font, 62, 556, "c) g(x) luôn không âm với mọi x thuộc R.", 10)
    text(pdf, font, 62, 536, "d) g(-1) = 0.", 10)
    text(pdf, font, 42, 488, "Câu 2. Cho hàm số có đồ thị như hình dưới đây. Xét các mệnh đề:", 11)
    text(pdf, font, 62, 464, "a) Đồ thị cắt trục tung tại điểm có tung độ 2.", 10)
    text(pdf, font, 62, 444, "b) Đồ thị có đúng một giao điểm với trục hoành.", 10)
    text(pdf, font, 62, 424, "c) Hàm số đồng biến trên R.", 10)
    text(pdf, font, 62, 404, "d) Đồ thị đối xứng qua trục tung.", 10)
    pdf.showPage()

    # Page 3: Part III numeric responses, including comma decimal and negative sign.
    text(pdf, font, 42, 758, LABEL, 9)
    part_heading(pdf, font, "PHẦN III - TRẢ LỜI NGẮN", 724)
    text(pdf, font, 42, 686, "Câu 1. Giải phương trình 2x + 3 = 33. Ghi kết quả dạng số.", 11)
    text(pdf, font, 42, 636, "Câu 2. Tính giá trị của biểu thức -1/2 và ghi kết quả.", 11)
    pdf.showPage()

    # Page 4: answer key sourced from this fixture itself.
    text(pdf, font, 42, 758, LABEL, 9)
    part_heading(pdf, font, "ANSWER KEY - SYNTHETIC SOURCE", 720)
    text(pdf, font, 42, 686, "PART I", 12)
    text(pdf, font, 62, 662, "1 A; 2 C; 3 D", 11)
    text(pdf, font, 42, 616, "PART II", 12)
    text(pdf, font, 62, 592, "1: a Đúng, b Đúng, c Sai, d Đúng", 11)
    text(pdf, font, 62, 568, "2: a Sai, b Đúng, c Sai, d Đúng", 11)
    text(pdf, font, 42, 522, "PART III", 12)
    text(pdf, font, 62, 498, "1: 15; 2: -0,5", 11)
    pdf.save()
    return OUTPUT


if __name__ == "__main__":
    print(generate())
