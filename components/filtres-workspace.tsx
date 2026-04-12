"use client";

import { FilterEditor } from "@/components/filter-editor";
import {
  SavedFiltersList,
  type SavedFilterListItem,
} from "@/components/saved-filters-list";

type AddressOption = { id: number; localPart: string; domain: string };

type FiltresWorkspaceProps = {
  addresses: AddressOption[];
  filters: SavedFilterListItem[];
};

export function FiltresWorkspace({ addresses, filters }: FiltresWorkspaceProps) {
  return (
    <div className="flex flex-col gap-8">
      <div data-tutorial-target="tutoriel-filtres-editeur">
        <FilterEditor addresses={addresses} variant="page" />
      </div>

      <div data-tutorial-target="tutoriel-filtres-liste">
        <SavedFiltersList addresses={addresses} filters={filters} />
      </div>
    </div>
  );
}
