import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ritmo · Diário de treino',
    short_name: 'Ritmo',
    description: 'Acompanhamento de treino de academia',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF7F1',
    theme_color: '#EE4E22',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
