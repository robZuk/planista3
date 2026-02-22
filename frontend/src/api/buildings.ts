import client from './client'
import type { Building, Room, RoomType } from '../types'

export const buildingsApi = {
  getAll: () =>
    client.get<{ data: Building[] }>('/buildings'),

  create: (data: { name: string; address?: string; facultyId?: string }) =>
    client.post<{ data: Building }>('/buildings', data),

  update: (id: string, data: { name?: string; address?: string; facultyId?: string }) =>
    client.put<{ data: Building }>(`/buildings/${id}`, data),

  remove: (id: string) =>
    client.delete(`/buildings/${id}`),

  createRoom: (buildingId: string, data: { number: string; type: RoomType; capacity: number }) =>
    client.post<{ data: Room }>(`/buildings/${buildingId}/rooms`, data),

  updateRoom: (buildingId: string, roomId: string, data: { number?: string; type?: RoomType; capacity?: number }) =>
    client.put<{ data: Room }>(`/buildings/${buildingId}/rooms/${roomId}`, data),

  removeRoom: (buildingId: string, roomId: string) =>
    client.delete(`/buildings/${buildingId}/rooms/${roomId}`),
}
