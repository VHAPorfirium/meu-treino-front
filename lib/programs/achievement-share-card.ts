import type { ProgramReport } from '@/lib/types';
import { buildAchievementStatsLine, buildAchievementTitle } from './achievement-summary';

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/** Quebra o texto em linhas que cabem na largura indicada. */
function wrapTextIntoLines(context: CanvasRenderingContext2D, text: string, maximumWidth: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidateLine).width > maximumWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidateLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawCenteredLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  lineHeight: number,
) {
  lines.forEach((line, lineIndex) => context.fillText(line, STORY_WIDTH / 2, startY + lineIndex * lineHeight));
}

/** Desenha o card da conquista no formato Stories (1080×1920) e devolve um PNG. */
export async function createAchievementShareImage(programReport: ProgramReport): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível');

  const backgroundGradient = context.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  backgroundGradient.addColorStop(0, '#1F1A17');
  backgroundGradient.addColorStop(1, '#3A2A12');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  context.textAlign = 'center';
  context.font = '320px serif';
  context.fillText('🥇', STORY_WIDTH / 2, 700);

  context.fillStyle = '#F5C451';
  context.font = 'bold 88px sans-serif';
  drawCenteredLines(context, wrapTextIntoLines(context, buildAchievementTitle(programReport), 900), 900, 104);

  context.fillStyle = '#FFFFFF';
  context.font = '600 56px sans-serif';
  drawCenteredLines(context, wrapTextIntoLines(context, programReport.programName, 900), 1230, 70);

  context.fillStyle = '#E8DCC8';
  context.font = '48px sans-serif';
  const statLines = buildAchievementStatsLine(programReport).split(' · ');
  drawCenteredLines(context, statLines, 1440, 72);

  context.fillStyle = '#EE4E22';
  context.font = 'bold 64px sans-serif';
  context.fillText('RITMO', STORY_WIDTH / 2, 1800);

  return new Promise((resolve, reject) =>
    canvas.toBlob((imageBlob) => (imageBlob ? resolve(imageBlob) : reject(new Error('Falha ao gerar imagem'))), 'image/png'),
  );
}

/** Compartilha pelo menu nativo (Stories etc.); sem suporte, baixa o PNG. */
export async function shareAchievement(programReport: ProgramReport): Promise<void> {
  const imageBlob = await createAchievementShareImage(programReport);
  const imageFile = new File([imageBlob], 'conquista-ritmo.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [imageFile] })) {
    await navigator.share({ files: [imageFile], title: buildAchievementTitle(programReport) });
    return;
  }

  const downloadUrl = URL.createObjectURL(imageBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = imageFile.name;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}
