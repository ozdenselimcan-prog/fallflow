import type { CaseDocument } from "@/lib/data/types";

/** Dokumente ohne internen Speicherpfad an Clients ausliefern. */
export const publicDocument = ({ storagePath, ...rest }: CaseDocument) => {
  void storagePath;
  return rest;
};
