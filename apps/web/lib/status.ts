export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Preparando',
  READY: 'Listo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pago pendiente',
  IN_PROCESS: 'En revisión',
  APPROVED: 'Pagado',
  REJECTED: 'Pago rechazado',
  CANCELLED: 'Pago cancelado',
  REFUNDED: 'Reembolsado',
  CHARGED_BACK: 'Contracargo',
};

export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  UNFULFILLED: 'Por preparar',
  PREPARING: 'En preparación',
  READY_FOR_PICKUP: 'Listo para recoger',
  SHIPPED: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  LABEL_CREATED: 'Guía creada',
  IN_TRANSIT: 'En tránsito',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  EXCEPTION: 'Incidencia',
  RETURNED: 'Devuelto',
  CANCELLED: 'Cancelado',
};

export function statusTone(status: string) {
  if (['APPROVED', 'COMPLETED', 'DELIVERED', 'READY', 'READY_FOR_PICKUP'].includes(status)) return 'success';
  if (['REJECTED', 'CANCELLED', 'EXPIRED', 'EXCEPTION', 'CHARGED_BACK'].includes(status)) return 'danger';
  if (['PROCESSING', 'PREPARING', 'IN_PROCESS', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status)) return 'info';
  return 'pending';
}
