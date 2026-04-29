import { Program, Site } from '../../db/models';
import { Transaction } from 'sequelize';
import { generateProgramAccessCode } from '../../utils/programAccessCode';

// Program response format interface
export interface ProgramResponse {
  programId: number;
  name: string;
  country: string;
  accessCode?: string;
}

export function formatProgramResponse(program: Program, options: { includeAccessCode?: boolean } = {}): ProgramResponse {
  const response: ProgramResponse = {
    programId: program.id,
    name: program.name,
    country: program.country,
  };

  if (options.includeAccessCode) {
    response.accessCode = program.accessCode;
  }

  return response;
}

export async function findProgramById(programId: number): Promise<Program | null> {
  return await Program.findByPk(programId);
}

export async function generateUniqueProgramAccessCode(transaction?: Transaction): Promise<string> {
  let accessCode = generateProgramAccessCode();
  while (await Program.findOne({ where: { accessCode }, transaction })) {
    accessCode = generateProgramAccessCode();
  }

  return accessCode;
}

export async function hasAssociatedSites(programId: number): Promise<boolean> {
  const siteCount = await Site.count({
    where: { programId },
  });
  return siteCount > 0;
} 