import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/admin-app';
import './admin.css';

export const metadata: Metadata = { title: 'Administración', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
