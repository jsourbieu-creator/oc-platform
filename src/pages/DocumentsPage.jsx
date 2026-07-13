import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FileLibrary } from "@/components/FileLibrary";

export function DocumentsPage() {
  const { hasPermission } = useAuth();
  const [canManage, setCanManage] = useState(false);

  useEffect(() => { hasPermission("manage_documents").then(setCanManage); }, [hasPermission]);

  return <FileLibrary kind="document" title="Documents" canManage={canManage} />;
}
