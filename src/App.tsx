import ImageDisplay from "./components/ImageDisplay";
import HolisticDetectors from "./ml/HolisticDetectors";

export default function App() {
  return (
    <div className="flex flex-col justify-center items-center gap-6 h-screen bg-gray-100">
      <div className="grid md:flex justify-center items-center gap-3">
        <HolisticDetectors />
        <ImageDisplay />
      </div>
    </div>
  );
}
