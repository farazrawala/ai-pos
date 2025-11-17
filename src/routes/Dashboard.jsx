import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import Footer from '../components/Footer.jsx';

const Dashboard = () => {
  const name = useSelector((state) => state.user.name);

  useEffect(() => {
    // Chart.js initialization
    const initChart = () => {
      const chartElement = document.getElementById('chart-line');
      if (chartElement && window.Chart) {
        try {
          const ctx1 = chartElement.getContext('2d');
          const gradientStroke1 = ctx1.createLinearGradient(0, 230, 0, 50);

          gradientStroke1.addColorStop(1, 'rgba(94, 114, 228, 0.2)');
          gradientStroke1.addColorStop(0.2, 'rgba(94, 114, 228, 0.0)');
          gradientStroke1.addColorStop(0, 'rgba(94, 114, 228, 0)');

          new window.Chart(ctx1, {
            type: 'line',
            data: {
              labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              datasets: [
                {
                  label: 'Mobile apps',
                  tension: 0.4,
                  pointRadius: 0,
                  borderColor: '#5e72e4',
                  backgroundColor: gradientStroke1,
                  borderWidth: 3,
                  fill: true,
                  data: [50, 40, 300, 220, 500, 250, 400, 230, 500],
                  maxBarThickness: 6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              interaction: {
                intersect: false,
                mode: 'index',
              },
              scales: {
                y: {
                  grid: {
                    drawBorder: false,
                    display: true,
                    drawOnChartArea: true,
                    drawTicks: false,
                    borderDash: [5, 5],
                  },
                  ticks: {
                    display: true,
                    padding: 10,
                    color: '#fbfbfb',
                    font: {
                      size: 11,
                      family: 'Open Sans',
                      style: 'normal',
                      lineHeight: 2,
                    },
                  },
                },
                x: {
                  grid: {
                    drawBorder: false,
                    display: false,
                    drawOnChartArea: false,
                    drawTicks: false,
                    borderDash: [5, 5],
                  },
                  ticks: {
                    display: true,
                    color: '#ccc',
                    padding: 20,
                    font: {
                      size: 11,
                      family: 'Open Sans',
                      style: 'normal',
                      lineHeight: 2,
                    },
                  },
                },
              },
            },
          });
        } catch (error) {
          console.error('Chart initialization error:', error);
        }
      }
    };

    // Scrollbar initialization
    const initScrollbar = () => {
      if (window.Scrollbar) {
        try {
          const win = navigator.platform.indexOf('Win') > -1;
          const scrollbarElement = document.querySelector('#sidenav-scrollbar');
          if (win && scrollbarElement) {
            const options = {
              damping: '0.5',
            };
            window.Scrollbar.init(scrollbarElement, options);
          }
        } catch (error) {
          console.error('Scrollbar initialization error:', error);
        }
      }
    };

    // Wait for scripts to load
    const checkAndInit = () => {
      initChart();
      initScrollbar();
    };

    // Try after a delay to ensure scripts are loaded
    const timeoutId = setTimeout(checkAndInit, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-lg-12">
            <div className="row">
              {/* Stats Cards */}
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            Today's Money
                          </p>
                          <h5 className="font-weight-bolder">$53,000</h5>
                          <p className="mb-0">
                            <span className="text-success text-sm font-weight-bolder">+55%</span>
                            since yesterday
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-primary shadow-primary text-center rounded-circle">
                          <i
                            className="ni ni-money-coins text-lg opacity-10"
                            aria-hidden="true"
                          ></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            Today's Users
                          </p>
                          <h5 className="font-weight-bolder">2,300</h5>
                          <p className="mb-0">
                            <span className="text-success text-sm font-weight-bolder">+3%</span>
                            since last week
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-danger shadow-danger text-center rounded-circle">
                          <i className="ni ni-world text-lg opacity-10" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            New Clients
                          </p>
                          <h5 className="font-weight-bolder">+3,462</h5>
                          <p className="mb-0">
                            <span className="text-danger text-sm font-weight-bolder">-2%</span>
                            last quarter
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-success shadow-success text-center rounded-circle">
                          <i
                            className="ni ni-paper-diploma text-lg opacity-10"
                            aria-hidden="true"
                          ></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">Sales</p>
                          <h5 className="font-weight-bolder">$103,430</h5>
                          <p className="mb-0">
                            <span className="text-success text-sm font-weight-bolder">+5%</span>{' '}
                            than last month
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-warning shadow-warning text-center rounded-circle">
                          <i className="ni ni-cart text-lg opacity-10" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-lg-7 mb-4 mb-lg-0">
            <div className="card z-index-2 h-100">
              <div className="card-header pb-0 pt-3 bg-transparent">
                <h6 className="text-capitalize">Sales overview</h6>
                <p className="text-sm mb-0">
                  <i className="fa fa-arrow-up text-success"></i>
                  <span className="font-weight-bold">4% more</span> in 2021
                </p>
              </div>
              <div className="card-body p-3">
                <div className="chart">
                  <canvas id="chart-line" className="chart-canvas" height="300"></canvas>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="card card-carousel overflow-hidden h-100 p-0">
              <div
                id="carouselExampleCaptions"
                className="carousel slide h-100"
                data-bs-ride="carousel"
              >
                <div className="carousel-inner border-radius-lg h-100">
                  <div
                    className="carousel-item h-100 active"
                    style={{
                      backgroundImage: "url('/assets/img/img-2.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <i className="ni ni-camera-compact text-dark opacity-10"></i>
                      </div>
                      <h5 className="text-white mb-1">Get started with Argon</h5>
                      <p>
                        There's nothing I really wanted to do in life that I wasn't able to get good
                        at.
                      </p>
                    </div>
                  </div>
                  <div
                    className="carousel-item h-100"
                    style={{
                      backgroundImage: "url('/assets/img/img-1.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <i className="ni ni-bulb-61 text-dark opacity-10"></i>
                      </div>
                      <h5 className="text-white mb-1">Faster way to create web pages</h5>
                      <p>
                        That's my skill. I'm not really specifically talented at anything except for
                        the ability to learn.
                      </p>
                    </div>
                  </div>
                  <div
                    className="carousel-item h-100"
                    style={{
                      backgroundImage: "url('/assets/img/img-3.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <i className="ni ni-trophy text-dark opacity-10"></i>
                      </div>
                      <h5 className="text-white mb-1">Share with us your design tips!</h5>
                      <p>
                        Don't be afraid to be wrong because you can't learn anything from a
                        compliment.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  className="carousel-control-prev w-5 me-3"
                  type="button"
                  data-bs-target="#carouselExampleCaptions"
                  data-bs-slide="prev"
                >
                  <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                  <span className="visually-hidden">Previous</span>
                </button>
                <button
                  className="carousel-control-next w-5 me-3"
                  type="button"
                  data-bs-target="#carouselExampleCaptions"
                  data-bs-slide="next"
                >
                  <span className="carousel-control-next-icon" aria-hidden="true"></span>
                  <span className="visually-hidden">Next</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
