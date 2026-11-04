import { memo, useCallback, useLayoutEffect, useRef } from "react";
import ProjectBoard from "./ProjectBoard";
import type { ProjectBoardProps } from "./ProjectBoard";
const Board = memo(ProjectBoard);
/** Opening a form must not rebuild every card. Forward commands to the latest
 * committed workspace closures, while keeping memoized board inputs stable. */
export default function WorkspaceBoard(props: ProjectBoardProps) {
  const commands = useRef(props);
  useLayoutEffect(() => {
    commands.current = props;
  });
  const onReorder = useCallback<ProjectBoardProps["onReorder"]>(
    (...args) => commands.current.onReorder(...args),
    [],
  );
  const onToggle = useCallback<ProjectBoardProps["onToggle"]>(
    (...args) => commands.current.onToggle(...args),
    [],
  );
  const onUpdate = useCallback<ProjectBoardProps["onUpdate"]>(
    (...args) => commands.current.onUpdate(...args),
    [],
  );
  const onDelete = useCallback<ProjectBoardProps["onDelete"]>(
    (...args) => commands.current.onDelete(...args),
    [],
  );
  return (
    <Board
      {...props}
      onReorder={onReorder}
      onToggle={onToggle}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
