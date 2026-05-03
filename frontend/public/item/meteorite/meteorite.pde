float angle = 0;

void setup() {
  size(400, 400);
  smooth();
}

void draw() {

  translate(width / 2, height / 2);

  // rotazione lenta
  rotate(angle);
  angle += 0.01;

  drawMeteor();
}

void drawMeteor() {

  noStroke();

  // glow esterno
  fill(255, 140, 60, 40);
  ellipse(0, 0, 90, 90);

  // corpo principale irregolare
  fill(120, 110, 100);

  beginShape();
  vertex(-35, -10);
  vertex(-20, -30);
  vertex(10, -35);
  vertex(35, -15);
  vertex(30, 20);
  vertex(5, 35);
  vertex(-25, 25);
  vertex(-40, 5);
  endShape(CLOSE);

  // ombreggiatura
  fill(90, 85, 80);

  beginShape();
  vertex(-35, -10);
  vertex(-10, 0);
  vertex(-5, 30);
  vertex(-25, 25);
  vertex(-40, 5);
  endShape(CLOSE);

  // crateri
  fill(70, 65, 60);

  ellipse(-10, -8, 10, 10);
  ellipse(15, -5, 7, 7);
  ellipse(8, 15, 12, 12);

  // luce frontale
  fill(255, 200, 120, 35);
  ellipse(12, -12, 35, 35);
}
