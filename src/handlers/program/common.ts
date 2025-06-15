import { Program, Site } from '../../db/models';

// Program response format interface
export interface ProgramResponse {
  programId: number;
  name: string;
  country: string;
}

export function formatProgramResponse(program: Program): ProgramResponse {
  return {
    programId: program.id,
    name: program.name,
    country: program.country,
  };
}

export async function findProgramById(programId: number): Promise<Program | null> {
  return await Program.findByPk(programId);
}

export async function hasAssociatedSites(programId: number): Promise<boolean> {
  const siteCount = await Site.count({
    where: { programId },
  });
  return siteCount > 0;
} 