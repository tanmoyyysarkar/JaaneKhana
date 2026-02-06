export default function Demo() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left side - Mobile view */}
          <div className="flex justify-center md:justify-start">
            <div className="relative w-full max-w-xs">
              {/* Mobile phone frame */}
              <div className="bg-black rounded-3xl shadow-2xl overflow-hidden border-8 border-black" style={{aspectRatio: '9/19.5'}}>
                {/* Notch */}
                <div className="absolute mt-3 left-1/2 transform -translate-x-1/2 bg-black rounded-full w-36 h-8 z-20"></div>
                
                {/* Screen content */}
                <div className="bg-white w-full h-full overflow-hidden">
                  <video
                    autoPlay
                    muted
                    loop
                    className="w-full h-full object-cover"
                  >
                    <source src="/demo.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Text content */}
          <div className="space-y-6">
             <div className="space-y-4">
               <h2 className="text-4xl md:text-5xl font-bold text-black">
                 See It In Action
               </h2>
              <p className="text-gray-700 text-lg leading-relaxed">
                Experience the seamless interface of JaaneKhana. Get instant food insights,
                understand nutrition labels, and connect with AI-powered food recommendations
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                 <div className="flex-shrink-0">
                   <div className="flex items-center justify-center h-12 w-12 rounded-md bg-lime-200">
                     <span className="text-black font-bold">1</span>
                   </div>
                 </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Quick Scan</h3>
                  <p className="text-gray-600 mt-1">Upload food labels and get instant AI analysis in seconds</p>
                </div>
              </div>

               <div className="flex items-start gap-4">
                 <div className="flex-shrink-0">
                   <div className="flex items-center justify-center h-12 w-12 rounded-md bg-lime-200">
                     <span className="text-black font-bold">2</span>
                   </div>
                 </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Nutrition Tracking</h3>
                  <p className="text-gray-600 mt-1">Monitor ingredients and get personalized nutrition insights</p>
                </div>
              </div>

               <div className="flex items-start gap-4">
                 <div className="flex-shrink-0">
                   <div className="flex items-center justify-center h-12 w-12 rounded-md bg-lime-200">
                     <span className="text-black font-bold">3</span>
                   </div>
                 </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">24/7 Support</h3>
                  <p className="text-gray-600 mt-1">Access your AI food assistant anytime, anywhere on any device</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
