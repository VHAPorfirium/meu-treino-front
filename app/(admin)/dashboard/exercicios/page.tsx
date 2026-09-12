'use client';

import { PageHead } from '@/components/dashboard/page-head';
import { ExerciseBrowser } from '@/components/dashboard/exercise-browser';

export default function ExerciciosPage() {
  return (
    <>
      <PageHead eyebrow="Catálogo" title="Exercícios" />
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <ExerciseBrowser />
      </div>
    </>
  );
}
