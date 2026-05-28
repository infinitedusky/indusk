import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full border-collapse text-left text-sm ${className}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-gray-200 bg-gray-50 ${className}`}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-gray-100 ${className}`} {...rest}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-gray-50 ${className}`} {...rest}>
      {children}
    </tr>
  );
}

export function TableHead({
  className = "",
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className = "",
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-2 text-gray-800 ${className}`} {...rest}>
      {children}
    </td>
  );
}
