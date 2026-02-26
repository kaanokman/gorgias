"use client";

import { useRouter, usePathname } from "next/navigation";
import { ListGroup } from "react-bootstrap";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Domains", path: "/dashboard/domains" },
    { label: "Reviews", path: "/dashboard/reviews" },
  ];

  return (
    <ListGroup className='rounded-0 border-0 w-100'>
      {navItems.map((item) => (
        <ListGroup.Item
          className='rounded m-0 bg-transparent'
          key={item.path}
          action
          active={pathname === item.path}
          onClick={() => router.push(item.path)}
          style={{
            border: "1px solid transparent",
            padding: "0.5rem 0.75rem",
          }}
        >
          {item.label}
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}
