import { axiosInstance } from "../lib/axios";

export const fetchGroups = async () => {
  const res = await axiosInstance.get("/groups");
  return res.data;
};

export const createGroup = async (payload) => {
  const res = await axiosInstance.post("/groups", payload);
  return res.data;
};
