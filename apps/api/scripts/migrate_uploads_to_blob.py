import asyncio
import os

from mamari_api.core.config import get_settings
from mamari_api.core.storage import read_file, store_file


async def migrate_uploads() -> None:
    settings = get_settings()
    if not any(
        (
            settings.blob_store_id,
            (
                settings.blob_read_write_token
                and settings.blob_read_write_token.get_secret_value()
            ),
            os.getenv("BLOB_READ_WRITE_TOKEN"),
            os.getenv("VERCEL_BLOB_READ_WRITE_TOKEN"),
        )
    ):
        raise RuntimeError(
            "Configurez BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN avant la migration."
        )

    upload_root = settings.upload_directory
    files = sorted(path for path in upload_root.rglob("*") if path.is_file())
    if not files:
        print("Aucun fichier à migrer.")
        return

    for index, path in enumerate(files, start=1):
        content = await asyncio.to_thread(path.read_bytes)
        await store_file(path, content)
        if await read_file(path) != content:
            raise RuntimeError(f"La vérification du fichier {path.name} a échoué.")
        print(f"Fichiers migrés et vérifiés : {index}/{len(files)}")


if __name__ == "__main__":
    asyncio.run(migrate_uploads())
