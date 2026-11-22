const AVATAR_COLORS = ['#EE4E22', '#5B3FBF', '#1E7A4F', '#B06E00', '#2563EB', '#BE185D'];

/** Cor estável por nome: a mesma pessoa sempre com a mesma cor. */
function colorForName(name: string): string {
  const nameHash = Array.from(name).reduce((hash, character) => hash + character.charCodeAt(0), 0);
  return AVATAR_COLORS[nameHash % AVATAR_COLORS.length];
}

/** Bolinha com a inicial do aluno. */
export function TraineeAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, background: colorForName(name), fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
