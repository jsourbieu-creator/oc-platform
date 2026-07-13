import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FileLibrary } from "@/components/FileLibrary";

export function MediasPage() {
  const { hasPermission } = useAuth();
  const [canManage, setCanManage] = useState(false);

  useEffect(() => { hasPermission("manage_media").then(setCanManage); }, [hasPermission]);

  return <FileLibrary kind="media" title="Médiathèque" canManage={canManage} />;
}
