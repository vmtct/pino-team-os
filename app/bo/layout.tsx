import BoWorkspaceLayout from "./BoWorkspaceLayout";

const BoShellWorkspace = BoWorkspaceLayout;

export default function BoLayout({ children }: { children: React.ReactNode }) {
  return <BoShellWorkspace>{children}</BoShellWorkspace>;
}
