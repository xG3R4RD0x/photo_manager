import { usePhotoStore } from "../stores/usePhotoStore";
import { useUIStore } from "../stores/useUIStore";

export function useTestData() {
  const setPhotos = usePhotoStore((s) => s.setPhotos);

  const loadMockPhotos = () => {
    const mockPhotos = [
      {
        path: "C:\\test\\photos\\DSC_1234.CR2",
        filename: "DSC_1234.CR2",
        date: "2025-05-20",
        file_size: 45_000_000,
      },
      {
        path: "C:\\test\\photos\\DSC_1235.CR2",
        filename: "DSC_1235.CR2",
        date: "2025-05-20",
        file_size: 48_000_000,
      },
      {
        path: "C:\\test\\photos\\DSC_1236.CR2",
        filename: "DSC_1236.CR2",
        date: "2025-05-19",
        file_size: 46_000_000,
      },
      {
        path: "C:\\test\\photos\\DSC_1237.NEF",
        filename: "DSC_1237.NEF",
        date: "2025-05-19",
        file_size: 42_000_000,
      },
      {
        path: "C:\\test\\photos\\DSC_1238.NEF",
        filename: "DSC_1238.NEF",
        date: "2025-05-18",
        file_size: 41_000_000,
      },
      {
        path: "C:\\test\\photos\\IMG_1001.ARW",
        filename: "IMG_1001.ARW",
        date: "2025-05-18",
        file_size: 50_000_000,
      },
    ];

    setPhotos(mockPhotos);
    useUIStore.setState({
      status: `Loaded ${mockPhotos.length} mock photos`,
    });
  };

  return { loadMockPhotos };
}
