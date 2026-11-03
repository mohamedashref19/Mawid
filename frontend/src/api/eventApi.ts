import apiClient from "./axiosConfig";

// تعريف نوع بيانات الايفنت
export interface EventData {
  title: string;
  type: "event" | "course";
  description: string;
  date: string;
  time: string;
  location: string;
  price: number;
  capacity: number;
  image?: string;
}

export const getAllEvents = (type?: string) => {
  const url = type ? `/events?type=${type}` : "/events";
  return apiClient.get(url);
};

export const getEventById = (id: string) => apiClient.get(`/events/${id}`);
export const createEvent = (data: EventData) => apiClient.post("/events", data);
// استخدمنا Partial عشان في التعديل ممكن نبعت السعر بس أو السعة بس
export const updateEvent = (id: string, data: Partial<EventData>) =>
  apiClient.patch(`/events/${id}`, data);
export const deleteEvent = (id: string) => apiClient.delete(`/events/${id}`);
