import CharacterForm from "@/components/CharacterForm";
import { createCharacter } from "@/app/actions";

export default function NewCharacterPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-display text-3xl">Yeni karakter</h1>
      <div className="card p-6">
        <CharacterForm action={createCharacter} submitLabel="Karakteri oluştur" />
      </div>
    </div>
  );
}
